export type TransactionType = 'expense' | 'income'

export interface Category {
  id: string
  name: string
  weekly_limit: number | null
}

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  amount: number // always positive; `type` says which direction
  type: TransactionType
  category_id: string | null
  note: string | null
  source: 'manual' | 'slip'
}

export type NewTransaction = Omit<Transaction, 'id' | 'source'>
