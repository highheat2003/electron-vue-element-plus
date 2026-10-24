import 'element-plus/dist/index.css'
import './assets/main.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ko from 'element-plus/es/locale/lang/ko'
import App from './App.vue'

createApp(App).use(ElementPlus, { locale: ko }).mount('#app')
