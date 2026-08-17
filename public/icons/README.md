# Ícones do PWA

`icon.svg` é o ícone-fonte (placeholder, derivado do logo). Para instalação em
Android/iOS com qualidade de loja, gere os PNGs a partir do logo oficial:

```bash
# Opção A — gerador do vite-plugin-pwa (recomendado)
npx @vite-pwa/assets-generator --preset minimal-2023 public/icons/icon.svg

# Opção B — manualmente com sharp
#   icon-192.png (192x192), icon-512.png (512x512), icon-maskable-512.png (512x512, com padding)
```

Arquivos esperados por `vite.config.ts` / `index.html`:

- `icon-192.png`
- `icon-512.png`
- `icon-maskable-512.png`
- `apple-splash-*.png` (telas de abertura iOS — geradas pelo mesmo comando)
