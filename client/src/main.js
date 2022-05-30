
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import useAppState from './AppState';
import { set } from 'pinia/node_modules/vue-demi';
import 'material-symbols';

const app = createApp(App)
app.use(router)
app.use(createPinia());

const state = useAppState();

router.beforeResolve((to) => {

    state.setRouteState(to.params);
    document.title = state.pageTitle;

});

app.mount('#app')


/*

TODO:

- read/unread icons
- next/previous buttons on message view
- page indicators
- report spam button
- delete forever when in Trash/Spam
- empty trash/spam
- click outside to close sidebar popup


*/