# ⚽ Sistema de Gerenciamento de Eventos Esportivos

Sistema web completo para gerenciamento de eventos esportivos com design mobile-first, cores do Brasil e experiência de usuário aprimorada.

## 🎨 Funcionalidades

### Painel Admin (index.html)
- ✅ Criação e edição de eventos
- ✅ Lista de eventos com filtros (Ativos, Próximos, Finalizados)
- ✅ Painel de detalhes do evento
- ✅ Gerenciamento de participantes (principal/reserva)
- ✅ Geração aleatória de times
- ✅ Controle de partida (timer/placar/apito sonoro)
- ✅ Lixeira com restauração e expiração automática (30 dias)
- ✅ Login opcional para criação de eventos

### Página Pública (evento.html)
- ✅ Visualização completa do evento
- ✅ Confirmação de presença
- ✅ Adição de convidados
- ✅ Lista de participantes/reserva
- ✅ Remoção com trava de 1h antes do início
- ✅ Mapa do Google Maps (oculto até confirmar presença)
- ✅ Cálculo automático de valor por pessoa

### Sincronização
- ✅ LocalStorage como base principal
- ✅ Integração com Supabase (pull a cada 3s)
- ✅ Upsert automático nas mudanças
- ✅ Marcação de deleted_at para sincronização
- ✅ Funcionamento offline completo

### Regras de Negócio
- ✅ Cálculo dinâmico de valor/pessoa
- ✅ Promoção automática da reserva quando abre vaga
- ✅ Finalização automática por tempo/duração
- ✅ Sorteio de times equilibrados
- ✅ Placar com limite de gols/tempo
- ✅ Links públicos com snapshot (`?id=...&s=...`)

## 🚀 Instruções de Uso

### Instalação Local

1. **Clone ou baixe os arquivos** para uma pasta:
   ```
   - index.html
   - evento.html
   - style.css
   - script.js
   ```

2. **Abra o `index.html`** em qualquer navegador moderno

3. **Para usar em produção**, faça upload dos arquivos para:
   - Vercel (recomendado)
   - Netlify
   - GitHub Pages
   - Qualquer hospedagem estática

### Configuração do Supabase (Opcional)

Para habilitar sincronização na nuvem:

1. Crie uma conta em [supabase.com](https://supabase.com)

2. Crie uma nova tabela chamada `events`:
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  max_players INTEGER NOT NULL,
  cost DECIMAL DEFAULT 0,
  duration INTEGER DEFAULT 60,
  require_login BOOLEAN DEFAULT false,
  participants JSONB DEFAULT '[]',
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  deleted_at TIMESTAMP
);
```

3. No `script.js`, configure as constantes:
```javascript
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon';
const SUPABASE_TABLE = 'events';
```

### Configuração do Google Maps (Opcional)

Para mapas interativos:

1. Obtenha uma API Key em [Google Cloud Console](https://console.cloud.google.com)

2. No `script.js`, configure:
```javascript
const GOOGLE_MAPS_API_KEY = 'sua-api-key';
```

3. Ou adicione no HTML antes do script.js:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=SUA_API_KEY"></script>
```

## 🎨 Design System

### Cores do Brasil
- **Verde:** `#009B3A` (primária)
- **Amarelo:** `#FFDF00` (destaques)
- **Azul:** `#002776` (secundária)

### Componentes
- Botões com estados hover/active
- Modais com animações suaves
- Toast notifications não-intrusivas
- Cards responsivos
- Badges de status
- Avatares com iniciais

### Acessibilidade
- Contraste WCAG AA
- Navegação por teclado completa
- Atributos ARIA
- Focus visible estilizado
- Áreas de toque ≥ 44px

## 📱 Performance

- Animações GPU-acceleradas
- Skeleton loading
- Lazy loading de imagens/mapas
- Timer eficiente com requestAnimationFrame
- Sincronização silenciosa em background

## 🔧 Estrutura de Arquivos

```
/workspace
├── index.html      # Painel admin
├── evento.html     # Página pública do evento
├── style.css       # Estilos e design system
└── script.js       # Lógica da aplicação
```

## 💡 Dicas de Uso

1. **Criar Evento:** Clique em "Novo Evento" e preencha os dados
2. **Compartilhar:** Use o link `evento.html?id=ID_DO_EVENTO`
3. **Gerenciar Partida:** Acesse o controle de partida para timer e placar
4. **Times Aleatórios:** Sortei times equilibrados automaticamente
5. **Lixeira:** Eventos excluídos ficam 30 dias na lixeira

## 🌐 Deploy na Vercel

1. Instale a CLI da Vercel:
```bash
npm i -g vercel
```

2. No diretório do projeto:
```bash
vercel --prod
```

3. Ou conecte seu repositório GitHub na Vercel

## 📝 Notas

- Não requer backend próprio (usa LocalStorage + Supabase opcional)
- Funciona offline completamente
- Dados sensíveis não são criptografados (use HTTPS em produção)
- Limite do LocalStorage: ~5-10MB dependendo do navegador

## 🤝 Contribuição

Este é um sistema open-source. Sinta-se à vontade para modificar e melhorar!

---

**Desenvolvido com 🇧🇷 e muito café!**
