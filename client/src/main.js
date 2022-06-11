
import { createApp, watch, markRaw } from 'vue'
import { createPinia, storeToRefs  } from 'pinia'
import App from './App.vue'
import useAppState from './AppState';
import router from './router'
import 'material-symbols';

const app = createApp(App)
const pinia = createPinia();

pinia.use(({ store }) => {
    store.$router = markRaw(router)
});

app.use(router)
app.use(pinia);

const state = useAppState();

router.beforeResolve((to) => {
    state.setRouteState(to.params);
});

const { mode } = storeToRefs(state)

watch(mode, () => {
    if (mode.value == 'loggedOut')
        router.push("/");
});

app.mount('#app')


