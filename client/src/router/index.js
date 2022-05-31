import { createRouter, createWebHashHistory } from 'vue-router'
import MessageList from '../MessageList.vue'
import MessageView from '../MessageView.vue'
import LoginPage from '../LoginPage.vue'

const router = createRouter({
  //history: createWebHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'loginPage',
      component: LoginPage,
      meta: {
                            // see router.beforeResolve in main.js
        guest: true,        // Doesn't require auth to acess
        container: "none",  // Doesn't require frame container (headers, sidebar etc...)
      }
    },
    {
      path: '/mail',
      redirect: '/mail/inbox'
    },
    {
      path: '/mail/search/:q',
      name: 'searchResults',
      component: MessageList
    },
    {
      path: '/mail/search/:q/:message_id',
      name: 'searchResultsMessage',
      component: MessageView
    },
    {
      path: '/mail/:folder/:message_id',
      name: 'message',
      component: MessageView
    },
    {
      path: '/mail/:folder',
      name: "folder",
      component: MessageList
    },
  ]
})

export default router
