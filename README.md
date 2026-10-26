# Mirante

Hub pessoal de notícias: reúne 34 veículos selecionados por rigor de apuração num só feed, com a **linha editorial de cada veículo** numa régua logo abaixo do título.

- **Início**: tudo o que saiu, do mais recente para o mais antigo, com "Mais cobertas agora" no topo.
- **Brasil — os dois lados**: política nacional separada em esquerda, centro e direita, com "Mesma pauta, ângulos diferentes" (o mesmo fato contado por veículos de campos diferentes, e quem não noticiou).
- **Mundo** e **Economia**: política internacional, guerras, petróleo, mercado financeiro.
- **Fontes**: perfil de cada veículo (dono, linha editorial, rigor, paywall) e só as matérias dele.
- Toque no **jornal** ou no **autor** de qualquer matéria para filtrar por ele. Filtros por linha editorial, tema, região, país, idioma e opinião × notícia.
- **Minhas assinaturas**: marque os jornais pagos que você assina e ligue "Só gratuitos e minhas assinaturas" para ver só o que consegue abrir (fica salvo em cada aparelho).
- **Tradução**: o botão 文A mostra as matérias em inglês em português e abre o texto pelo Google Tradutor.
- **Cores da régua**: roxo à esquerda, cinza no centro, laranja à direita (paleta PuOr, segura para daltonismo; vermelho e azul foram evitados porque significam coisas opostas no Brasil e nos EUA).

As notícias são atualizadas a cada 15 minutos. O app funciona como aplicativo instalado na tela do celular (PWA) e abre mesmo sem conexão, com a última coleta.

## Colocar no celular

### Opção A — GitHub Pages (recomendada: funciona 24 h, em qualquer lugar, sem computador ligado)

1. O GitHub Pages gratuito só publica repositórios **públicos**. Em *Settings → General → Danger Zone → Change visibility*, torne o repositório público (o código não tem nada sigiloso), **ou** use um plano GitHub Pro.
2. *Settings → Pages → Build and deployment → Source*: escolha **GitHub Actions**.
3. Leve este código para a branch `main` (merge do pull request).
4. Em *Actions → Atualizar notícias → Run workflow*, rode a primeira vez. Depois disso cada rodada dispara a seguinte, a cada 15 minutos (o agendamento do GitHub atrasa e às vezes nem dispara, então fica só como reserva).
5. Abra `https://<seu-usuário>.github.io/News/` no celular:
   - **iPhone (Safari)**: Compartilhar → *Adicionar à Tela de Início*.
   - **Android (Chrome)**: menu ⋮ → *Instalar app*.

> Em repositório público, os minutos de Actions são gratuitos. Em repositório privado não use a corrente: entre uma rodada e outra ela deixa uma máquina esperando, o que gastaria cerca de 43 mil minutos por mês. Crie a variável `ATUALIZACAO_CONTINUA` com o valor `off` (*Settings → Secrets and variables → Actions → Variables*) e use o `cron` em `.github/workflows/update.yml`, por exemplo `'7,37 * * * *'` (a cada 30 min, cerca de 1.500 minutos por mês).
>
> Para parar as atualizações: desative o workflow em *Actions → Atualizar notícias → ⋯ → Disable workflow*, ou crie a mesma variável com `off`.

### Opção B — seu computador como servidor

Precisa do [Node.js 20+](https://nodejs.org).

```bash
npm install
npm start
```

O terminal mostra dois endereços: um para o computador e outro (`http://192.168.x.x:8080`) para o celular **na mesma rede Wi-Fi**. As notícias são atualizadas a cada 10 minutos enquanto o terminal estiver aberto.

Limitações desta opção: o computador precisa ficar ligado; fora de casa o celular não alcança o endereço; e sem HTTPS o celular instala o app como atalho, sem o modo offline. Para usar fora de casa com HTTPS, instale o [Tailscale](https://tailscale.com) no computador e no celular e rode `tailscale serve 8080`: ele gera um endereço `https://<computador>.<rede>.ts.net` que só os seus aparelhos acessam.

Sem internet (para testar a interface): `DEMO=1 npm start` usa uma coleta real salva em `test/fixtures/feed.json`.

## Como as fontes são escolhidas e classificadas

A lista completa, com dono, nota editorial e feeds, fica em [`config/sources.mjs`](config/sources.mjs).

- **Régua (linha editorial)**: mede o veículo, não cada texto, de −1 (esquerda) a +1 (direita). Internacionais seguem as avaliações públicas do AllSides e do Ad Fontes Media. Para os brasileiros não existe auditoria independente equivalente; a posição é editorial e vem explicada no perfil de cada veículo.
- **Rigor**: checagem, correções públicas e histórico. Ficaram de fora veículos de grande alcance com histórico de sensacionalismo ou desinformação.
- **WSJ** tem duas réguas: reportagem perto do centro e página de opinião à direita (o feed de opinião carrega o próprio viés).
- **Opinião × notícia**: colunas, editoriais e análises são marcados pelo endereço da matéria (`/opiniao/`, `/colunas/`, `/opinion/`…).
- **Reuters e AP** não oferecem RSS público; os títulos chegam pelo Google Notícias, sem autor. **The Economist** não assina textos por política própria.

O lado direito tem menos veículos de qualidade no Brasil do que o esquerdo e o centro: Estadão e Veja (centro-direita) e Gazeta do Povo (direita). A aba Brasil compensa isso intercalando os três campos e mostrando o volume de cada um.

### Adicionar ou remover um veículo

Edite `config/sources.mjs`: cada veículo tem `id`, `name`, `country`, `lang`, `bias`, `rigor`, `paywall`, `owner`, `note` e a lista de `feeds` (URL do RSS + seção). Rode `npm run report` para ver se o feed responde e quantas matérias, autores e imagens ele traz.

## Estrutura

```
config/          fontes, temas e palavras-chave
lib/             leitura de RSS, normalização, temas, autores, "mesma pauta"
scripts/         build-feed.mjs: coleta tudo e gera public/data/feed.json
public/          o app (HTML, CSS e JS sem dependências), ícones, fontes e service worker
server.mjs       servidor local com atualização automática
test/            testes (npm test) e uma coleta real de exemplo
```

Tipografia: Piazzolla e Schibsted Grotesk (SIL Open Font License), servidas localmente.
