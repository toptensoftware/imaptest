<script setup>

import { computed } from 'vue';
import addrparser from 'address-rfc2822';
import useAppState from './AppState';

const state = useAppState();
const props = defineProps(['addr', 'excludeMe', 'label']);

const addresses = computed(() => {
    if (!props.addr)
        return [];

    let addresses = addrparser.parse(props.addr).map(x => {
        if (x.address.toLowerCase() == state.user.toLowerCase())
        {
            // Display the current user as 'me'
            return { display: "me", title: x.address, isme: true }
        }
        else
        {
            // anti-phishing check.  If display name has an '@'
            // symbol, display the actual email address instead
            // (and the full address in the tool tip)
            let name = x.name();
            if (name.indexOf('@')>=0)      
                return { display: x.address, title: x.format() }
            else if (name)
                return { display: name, title: x.address }
            else
                return { display: x.address.substring(0, x.address.indexOf('@')), title: x.address }
        }
    });

    if (props.excludeMe)
    {
        if (!(addresses.length == 1 && addresses[0].isme))
        {
            addresses = addresses.filter(x => !x.isme);
        }
    }

    return addresses;
});

</script>

<template>

<template v-if="addresses.length > 0">
<template v-if="props.label">{{props.label}} </template>
<span class="email-address" v-for="a,i in addresses" :title="a.title">
    <template v-if="i>0">, </template>
    {{ a.display }}
</span>
</template>

</template>

<styles>
</styles>