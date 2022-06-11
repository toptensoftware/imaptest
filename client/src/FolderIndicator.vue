<script setup>

import { computed } from 'vue';
import useAppState from './AppState';
import { special_folders } from './SpecialFolderInfo';

const state = useAppState();
const props = defineProps(['folders']);

const uniqueFolders = computed(() => [...new Set(props.folders)]);

function mapFolderName(f)
{
    for (let folder of state.folders)
    {
        if (folder.name.toLowerCase() == f.toLowerCase())
        {
            let si = special_folders[folder.special_use_attrib];
            if (si)
                return si.title;
        }
    }
    return f;
}

</script>

<template>
<span v-for="f in uniqueFolders" class="folder-indicator badge rounded-pill bg-secondary">{{mapFolderName(f)}}</span>
</template>

<style>
.folder-indicator
{
    margin-left: 5px;
}
</style>