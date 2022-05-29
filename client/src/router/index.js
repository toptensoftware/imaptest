import { createRouter, createWebHashHistory } from 'vue-router'
import MessageList from '../MessageList.vue'
import MessageView from '../MessageView.vue'

const router = createRouter({
  //history: createWebHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/inbox'
    },
    {
      path: '/search/:q',
      name: 'searchResults',
      component: MessageList
    },
    {
      path: '/search/:q/:message_id',
      name: 'searchResultsMessage',
      component: MessageView
    },
    {
      path: '/:folder/:message_id',
      name: 'message',
      component: MessageView
    },
    {
      path: '/:folder',
      name: "folder",
      component: MessageList
    },
  ]
})

export default router
