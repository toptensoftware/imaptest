
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import useAppState from './AppState';
import { set } from 'pinia/node_modules/vue-demi';

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


*/

/*
Material icon names

inbox
stars
snooze
label_important
send
schedule_send
draft
mail
settings
archive
move_to_inbox
drive_file_move_outline
block (for spam)
check
check_box
check_box_outline_blank
indeterminate_check_box
close
mark_as_unread
chevron_left
keyboard_arrow_left
menu
display_settings


https://marella.me/material-symbols/demo/
https://glyphsearch.com

*/
