<script setup>
import { ref } from 'vue';
import useAppState from './AppState';
import { useRouter } from 'vue-router';

const state = useAppState();
const router = useRouter();

const user = ref("");
const pass = ref("");

async function onSubmit()
{
    let response = await fetch("http://localhost:4000/api/createSession", {

        method: 'POST',
        credentials: "same-origin",
        cache: "no-cache",
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ user: user.value, pass: pass.value })
    });
    let data = await response.json();

    if (data.result == "OK")
    {
        let response = await fetch("http://localhost:4000/api/openSession", {

            method: 'POST',
            credentials: "same-origin",
            cache: "no-cache",
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({  })
        });
        let data = await response.json();
        alert(JSON.stringify(data));
    }

}

</script>
<template>

    <div class="login-form vh-100 d-flex align-items-center justify-content-center">
        
        <form class="row">
            <fieldset>

                <p class="text-center">
                <img src="/icon_dark_fine.svg" />
                </p>

                <div class="form-group">
                    <div class="input-group">
                    <span class="input-group-text"><i class="symbol">person_outline</i></span>
                    <input v-model="user" type="username" class="form-control" id="username" placeholder="Username" autofocus>
                    </div>
                </div>
                
                <div class="form-group mt-1">
                    <div class="input-group">
                        <span class="input-group-text"><i class="symbol">lock</i></span>
                    <input v-model="pass" type="password" class="form-control" id="password" placeholder="Password">
                    </div>
                </div>

                <div class="form-check form-switch mt-3 mb-4">
                    <input class="form-check-input" type="checkbox" id="persistent-login">
                    <label class="form-check-label" for="flexSwitchCheckChecked">Trust this device and stay logged in</label>
                </div>
                
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary" @click="onSubmit">Login</button>
                </div>            

            </fieldset>
        </form>    
    </div>

</template>

<style>

.login-form fieldset
{
    width: 360px;
}

.login-form img
{
    width: 120px;
    height: auto;
}

.login-form i
{
    transform: translate(0, 0);
    font-size: 22px;
}

</style>