<template>

    <!-- Floating Compose Button (bottom-right, when side bar collapsed) -->
    <button id="floating-compose-button" class="btn btn-outline-success">
        <span class="symbol">create</span><span class="label">Compose</span>
    </button>

</template>

<style>

#floating-compose-button
{
    position:fixed;
    right: 1rem;
    bottom: 1rem;
    min-width:52px;
    min-height:52px;
    padding: 10px;
    border-radius: 100rem;
    font-size: 1.2rem;
}

#floating-compose-button span.label
{
    padding-left: 10px;
    padding-right: 10px;
    font-size: 1.3rem;
    display: none;
}


</style>