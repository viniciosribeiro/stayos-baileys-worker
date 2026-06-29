# StayOS Baileys Worker

Worker WhatsApp (Baileys) para o StayOS.

## Deploy rapidíssimo no Railway

1. Crie um repositório novo no GitHub: https://github.com/new
   (pode ser privado; nome sugerido: `stayos-baileys-worker`)
2. No repositório recém-criado, clique em **Add file → Upload files** e
   arraste os 4 arquivos deste zip (`Dockerfile`, `index.mjs`,
   `package.json`, `README.md`). Confirme o commit.
3. Vá em https://railway.app/new → **Deploy from GitHub repo** e escolha
   o repositório que você acabou de criar.
4. Em **Settings → Variables**, adicione:
   - `WORKER_SECRET` = (o segredo gerado pelo StayOS — cole o mesmo valor que está em Master → Integrações)
   - `STAYOS_WEBHOOK_BASE` = URL pública do seu StayOS (ex.: https://project--xxxx.lovable.app)
5. Em **Settings → Volumes**, monte um volume em `/data` (1 GB basta).
6. Em **Settings → Networking**, clique **Generate Domain** e copie a URL.
7. Volte ao StayOS → **Master → Integrações**, cole a URL e clique
   **Testar conexão**.

Pronto. Não precisa de mais nada — todos os tenants passam a poder
conectar WhatsApp via QR.
