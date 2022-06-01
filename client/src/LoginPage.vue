<script setup>
import { ref } from 'vue';
import useAppState from './AppState';
import { useRouter } from 'vue-router';
import api from './api';

const state = useAppState();
const router = useRouter();

const user = ref("");
const pass = ref("");
const persistent = ref(false);

async function onSubmit()
{
    let r = await api.post("/api/createSession", {
        user: user.value,
        pass: pass.value,
        persistent: persistent.value
    });

    alert(JSON.stringify(r));

    let r2 = await api.post("/api/openSession", {});
    alert(JSON.stringify(r2));
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
                    <input v-model="persistent" class="form-check-input" type="checkbox" id="persistent-login">
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