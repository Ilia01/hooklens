import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePageContent from './components/HomePageContent.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePageContent', HomePageContent)
  },
} satisfies Theme
