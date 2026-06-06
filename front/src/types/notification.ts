export interface NotificationItem {
  id: string
  title: string
  content: string
  category: string
  read: boolean
  createdAt: number
}

export interface NotificationListResult {
  list: NotificationItem[]
  total: number
}

export interface NotificationPublishPayload {
  title: string
  content: string
  category: string
}
