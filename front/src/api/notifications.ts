import request from '../utils/request'
import type { ApiResp } from '../utils/request'
import type { NotificationListResult, NotificationPublishPayload } from '../types/notification'

/**
 * 获取通知分页列表
 * @param params 分页参数，page 为页码，pageSize 为每页数量
 * @returns 返回通知列表和总数
 */
export const getNotifications = (params: { page: number; pageSize: number }) =>
  request.get<ApiResp<NotificationListResult>>('/api/notifications', { params })

/**
 * 获取未读通知列表
 * @returns 返回当前用户未读通知数组
 */
export const getUnreadNotifications = () => request.get<ApiResp<unknown[]>>('/api/notifications/unread')

/**
 * 标记单条通知为已读
 * @param id 通知ID
 * @returns 返回后端处理结果
 */
export const markNotificationAsRead = (id: string) => request.put<ApiResp<null>>(`/api/notifications/${id}/read`)

/**
 * 标记当前用户全部通知为已读
 * @returns 返回后端处理结果
 */
export const markAllNotificationsAsRead = () => request.post<ApiResp<null>>('/api/notifications/read-all')

/**
 * 发布一条系统通知
 * @param payload 通知标题、内容和类型
 * @returns 返回后端创建结果
 */
export const createNotification = (payload: NotificationPublishPayload) =>
  request.post<ApiResp<null>>('/api/notifications', payload)

/**
 * 删除指定通知
 * @param id 通知ID
 * @returns 返回后端处理结果
 */
export const deleteNotification = (id: string) => request.delete<ApiResp<null>>(`/api/notifications/${id}`)
