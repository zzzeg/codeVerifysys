<script setup lang="ts">
import 'element-plus/es/components/pagination/style/css'
import { ElPagination } from 'element-plus'
import { usePaginationConfig } from '../../composables/usePaginationConfig'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  pagerCount?: number
}>()

const { paginationPagerCount } = usePaginationConfig()
</script>

<template>
  <ElPagination v-bind="$attrs" :pager-count="props.pagerCount ?? paginationPagerCount" />
</template>
