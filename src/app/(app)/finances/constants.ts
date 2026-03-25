export const EXPENSE_CATEGORIES = [
  "Housing",
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health & Medical",
  "Subscriptions",
  "Personal Care",
  "Education",
  "Travel",
  "Gifts & Donations",
  "Business",
  "Other",
] as const

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Rental",
  "Gift",
  "Other",
] as const

export const ALL_CATEGORIES = [
  ...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]),
] as string[]

export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const

export const INCOME_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "annually",
  "one-time",
] as const

export const EXPENSE_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annually",
] as const

export const ENGAGEMENT_STATUSES = ["active", "completed", "paid"] as const
export const DEFAULT_TAX_RATE = 0.30

export const INSURANCE_TYPES = [
  "Health",
  "Dental",
  "Vision",
  "Auto",
  "Home",
  "Renters",
  "Life",
  "Disability",
  "Pet",
  "Other",
] as const

export const CREDIT_ACCOUNT_TYPES = [
  "credit_card",
  "student_loan",
  "personal_loan",
  "auto_loan",
  "mortgage",
  "other",
] as const

export const CREDIT_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  personal_loan: "Personal Loan",
  auto_loan: "Auto Loan",
  mortgage: "Mortgage",
  other: "Other",
}

export const RATING_COLORS: Record<string, string> = {
  Excellent: "text-green-500 bg-green-500/10 border-green-500/30",
  Good: "text-lime-500 bg-lime-500/10 border-lime-500/30",
  Fair: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  "Needs work": "text-orange-500 bg-orange-500/10 border-orange-500/30",
  Poor: "text-red-500 bg-red-500/10 border-red-500/30",
}
