
import { filter, createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import useAppState from './AppState';
import Utils from './Utils';

const app = createApp(App)
app.use(router)
app.use(createPinia());

const state = useAppState();


//app.config.globalProperties.formatDateFromSeconds = Utils.formatDateFromSeconds;
app.config.globalProperties.globalVar = 'globalVar';
  
  

router.beforeResolve((to) => {

    state.setRouteState(to.params);
    document.title = state.pageTitle;

});

app.mount('#app')


