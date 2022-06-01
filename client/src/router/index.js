import { createRouter, createWebHashHistory } from 'vue-router'
import MessageList from '../MessageList.vue'
import MessageView from '../MessageView.vue'

const router = createRouter({
  //history: createWebHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
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
