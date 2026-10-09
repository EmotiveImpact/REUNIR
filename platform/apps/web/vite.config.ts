import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig(({mode})=>({
    plugins:[tailwindcss()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
    root:fileURLToPath(new URL('.',import.meta.url)),envDir:fileURLToPath(new URL('../../',import.meta.url)),base:'./',
    define:mode==='standalone'?{'import.meta.env.VITE_DATA_MODE':JSON.stringify('demo')}:undefined,
    build:{outDir:mode==='standalone'?'../../.standalone-dist':'../../dist',emptyOutDir:true,target:'es2022',
        // The single-file preview needs everything inline; a hosted build keeps images as files the browser can cache.
        assetsInlineLimit:mode==='standalone'?100000:4096,
        rollupOptions:{output:mode==='standalone'?{inlineDynamicImports:true}:{manualChunks:{'react-runtime':['react','react-dom','react-dom/client','react-router-dom'],'query-runtime':['@tanstack/react-query']}}}},
    server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}}
}));
