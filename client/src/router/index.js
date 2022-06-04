import { createRouter, createWebHashHistory } from 'vue-router'
import ConversationList from '../ConversationList.vue'
import ConversationView from '../ConversationView.vue'

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
      component: ConversationList
    },
    {
      path: '/mail/search/:q/:conversation_id',
      name: 'searchResultsConversation',
      component: ConversationView
    },
    {
      path: '/mail/:folder/:conversation_id',
      name: 'conversation',
      component: ConversationView
    },
    {
      path: '/mail/:folder',
      name: "folder",
      component: ConversationList
    },
  ]
})

export default router
