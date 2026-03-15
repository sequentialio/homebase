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
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
] as string[]

export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const

export const INCOME_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "annually",
  "one-time",
] as const

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
