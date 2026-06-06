import { computed, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessageBox } from 'element-plus'

type SnapshotGetter = () => unknown

interface UnsavedChangesGuardOptions {
  getSnapshot: SnapshotGetter
  message?: string
}

/**
 * 标准化快照数据
 * @param value 原始快照数据，可以是对象、数组或基础类型
 * @returns 返回字段顺序稳定的快照数据，用于比较表单是否变化
 */
const normalizeSnapshot = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshot(item))
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeSnapshot((value as Record<string, unknown>)[key])
        return result
      }, {})
  }
  return value
}

/**
 * 序列化表单快照
 * @param value 原始表单快照
 * @returns 返回可稳定比较的字符串
 */
const stringifySnapshot = (value: unknown) => JSON.stringify(normalizeSnapshot(value))

/**
 * 注册未保存表单离开确认
 * @param options 配置项，getSnapshot 用于获取当前表单快照，message 用于自定义确认文案
 * @returns 返回 dirty 状态、重置基准快照方法和标记已保存方法
 */
export const useUnsavedChangesGuard = (options: UnsavedChangesGuardOptions) => {
  const baselineSnapshot = ref('')
  const guardEnabled = ref(true)
  const message = options.message || '当前页面有未保存的数据，离开后将丢失，是否确认离开？'
  const currentSnapshot = computed(() => stringifySnapshot(options.getSnapshot()))
  const isDirty = computed(() => guardEnabled.value && baselineSnapshot.value !== '' && currentSnapshot.value !== baselineSnapshot.value)

  /**
   * 重置表单变更基准
   * @returns 无返回值，内部记录当前快照作为未变更状态
   */
  const resetBaseline = () => {
    baselineSnapshot.value = currentSnapshot.value
    guardEnabled.value = true
  }

  /**
   * 标记当前表单已经保存
   * @returns 无返回值，内部关闭本次离开确认并刷新基准快照
   */
  const markSaved = () => {
    baselineSnapshot.value = currentSnapshot.value
    guardEnabled.value = false
  }

  onBeforeRouteLeave(async () => {
    if (!isDirty.value) return true
    try {
      // 1. 提示用户确认是否放弃未保存数据
      await ElMessageBox.confirm(message, '离开确认', {
        confirmButtonText: '确认离开',
        cancelButtonText: '取消',
        type: 'warning',
      })
      // 2. 用户确认后允许路由离开
      return true
    } catch {
      // 3. 用户取消后阻止路由跳转
      return false
    }
  })

  return {
    isDirty,
    resetBaseline,
    markSaved,
  }
}
