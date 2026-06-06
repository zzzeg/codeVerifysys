import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/el-message-box.css'
import './style.css'
import App from './App.vue'
import { setupMobileTableTapFix } from './utils/mobileTableTap'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
setupMobileTableTapFix()
