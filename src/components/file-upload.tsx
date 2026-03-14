"use client"

/**
 * FileUpload — attach images and documents to any entity.
 *
 * Usage:
 *   <FileUpload entityId={id} bucket="entity-files" tableName="entity_files" />
 *
 * Requires a Supabase table with these columns:
 *   id, entity_id, storage_path, file_name, file_size, mime_type, uploaded_by, created_at
 *
 * Supabase storage bucket must have RLS policies for authenticated reads/writes.
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Camera, Upload, X, Loader2, FileText, Paperclip, ExternalLink } from "lucide-react"
import { toast } from "sonner"

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",")

function isImage(mimeType: string | null) {
  return mimeType?.startsWith("image/") ?? false
}

function maxSize(mimeType: string) {
  return isImage(mimeType) ? 10 * 1024 * 1024 : 25 * 1024 * 1024
}

function formatSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileRow {
  id: string
  storage_path: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  signedUrl: string | null
}

interface FileUploadProps {
  entityId: string
  /** Supabase storage bucket name */
  bucket?: string
  /** Supabase table name that stores file metadata */
  tableName?: string
}

export function FileUpload({
  entityId,
  bucket = "entity-files",
  tableName = "entity_files",
}: FileUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFiles = useCallback(async () => {
    const { data } = await supabase
      .from(tableName)
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })

    if (data && data.length > 0) {
      const withUrls: FileRow[] = await Promise.all(
        data.map(async (f) => {
          const { data: urlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(f.storage_path, 3600)
          return { ...f, signedUrl: urlData?.signedUrl ?? null }
        })
      )
      setFiles(withUrls)
    } else {
      setFiles([])
    }
    setLoading(false)
  }, [entityId, bucket, tableName, supabase])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const inputFiles = e.target.files
    if (!inputFiles?.length) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let count = 0

    for (const file of Array.from(inputFiles)) {
      if (file.size > maxSize(file.type)) {
        toast.error(`${file.name} is too large (max ${isImage(file.type) ? "10MB" : "25MB"})`)
        continue
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin"
      const path = `${entityId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type })

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`)
        continue
      }

      await supabase.from(tableName).insert({
        entity_id: entityId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id ?? null,
      })
      count++
    }

    await loadFiles()
    setUploading(false)
    if (count > 0) toast.success(`${count} file${count !== 1 ? "s" : ""} uploaded`)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleDelete(file: FileRow) {
    await supabase.storage.from(bucket).remove([file.storage_path])
    await supabase.from(tableName).delete().eq("id", file.id)
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
    toast.success("File removed")
  }

  const images = files.filter((f) => isImage(f.mime_type))
  const documents = files.filter((f) => !isImage(f.mime_type))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-5" />
          Files & Photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
          {/* Camera capture — shown only on mobile */}
          <Button
            type="button"
            variant="outline"
            className="sm:hidden"
            disabled={uploading}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = "image/*"
              input.capture = "environment"
              input.onchange = (ev) => {
                const target = ev.target as HTMLInputElement
                if (target.files && fileInputRef.current) {
                  const dt = new DataTransfer()
                  Array.from(target.files).forEach((f) => dt.items.add(f))
                  fileInputRef.current.files = dt.files
                  fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
                }
              }
              input.click()
            }}
          >
            <Camera className="size-4 mr-2" />
            Camera
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Images (JPEG, PNG, WebP, HEIC), PDFs, Word, Excel · Max 10 MB images / 25 MB documents
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading files...</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet</p>
        ) : (
          <div className="space-y-4">
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((photo) => (
                  <div key={photo.id} className="relative group rounded-md overflow-hidden border">
                    {photo.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.signedUrl} alt={photo.file_name ?? "Photo"} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-muted text-muted-foreground text-xs">Unable to load</div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(photo)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                    {photo.file_name && (
                      <p className="text-xs truncate px-1 py-0.5 text-muted-foreground">{photo.file_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {documents.length > 0 && (
              <div className="space-y-2">
                {images.length > 0 && <p className="text-xs font-medium text-muted-foreground">Documents</p>}
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-md border p-3 group">
                    <FileText className="size-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name ?? "Document"}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(doc.file_size)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {doc.signedUrl && (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
