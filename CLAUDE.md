# CLAUDE.md - Convenções do Projeto AiraFit

> Para contexto completo do projeto (arquitetura, estado atual, roadmap), consulte `CLAUDE_CONTEXT.md`.

---

## Estrutura de Componentes Angular (Frontend)

Todos os componentes Angular devem ser separados em **3 arquivos**:

```
component-name/
  component-name.component.ts    # Apenas lógica (classe, signals, serviços)
  component-name.component.html  # Template HTML
  component-name.component.scss  # Estilos SCSS
```

### Regras obrigatórias

- **NUNCA** usar `template:` inline no decorator `@Component`. Usar `templateUrl: './nome.component.html'`
- **NUNCA** usar `styles:` inline no decorator `@Component`. Usar `styleUrls: ['./nome.component.scss']`
- Cada componente deve ter seus 3 arquivos separados, sem exceção
- Manter o arquivo `.ts` focado exclusivamente em lógica (imports, injeção de dependências, métodos, signals/computed)

### Exemplo de @Component correto

```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./example.component.scss'],
  templateUrl: './example.component.html',
})
export class ExampleComponent { ... }
```

---

## Convenções Gerais

- **Linguagem da interface**: Português (pt-BR)
- **Framework**: Angular 17+ com standalone components e novo control flow (`@if`, `@for`, `@switch`)
- **Estado local**: Angular Signals (`signal`, `computed`, `effect`)
- **Estilização**: SCSS com variáveis CSS custom properties (`--color-primary`, `--radius-md`, etc.)
- **Change detection**: OnPush por default (configurado no `angular.json`)

---

## Convenções do Backend

- **Controllers**: Métodos estáticos (`static async method(req, res)`)
- **Autenticação**: Cookie HttpOnly (`ha_token`) com fallback para Bearer header
- **Multi-tenant**: Todas as queries DEVEM filtrar por `req.userId`
- **Migrações**: Classes TypeORM com SQL raw em `up()` e `down()`
- **Variáveis de ambiente**: Centralizadas em `config/env.ts`, nunca hardcoded

---

## Segurança — Regras Obrigatórias

- **NUNCA** armazenar tokens/secrets em localStorage (usar HttpOnly cookies)
- **NUNCA** logar PII/PHI (nomes, emails, dados de saúde, tokens)
- **NUNCA** permitir acesso cross-user sem checagem de `userId`
- **NUNCA** desabilitar CORS ou security headers
- **SEMPRE** validar input em endpoints públicos
- **SEMPRE** usar `withCredentials: true` em requests HTTP do frontend

---

## Design Tokens (CSS Custom Properties)

Usar as variáveis definidas em `styles.scss`. Principais:

```scss
// Cores
--color-primary, --color-primary-dark, --color-primary-light
--color-secondary, --color-accent, --color-danger, --color-warning, --color-success, --color-info
--color-bg, --color-surface, --color-surface-2, --color-border
--color-text, --color-text-muted, --color-text-subtle

// Layout
--radius-sm (6px), --radius-md (12px), --radius-lg (20px), --radius-xl (32px)
--shadow-sm, --shadow-md, --shadow-lg

// Tipografia
--font-body: 'Lexend'    // corpo, inputs, botões
--font-heading: 'Sen'    // títulos, labels, headings
```

---

## Mobile / PWA

- Touch targets mínimo **44px** em mobile
- Inputs com `font-size: 16px` em mobile (previne auto-zoom iOS)
- Usar `overscroll-behavior-y: contain` em contêineres scrolláveis
- Remover `-webkit-tap-highlight-color` em elementos interativos
- Testar com `viewport-fit=cover` para dispositivos com notch

---

## Estrutura de Rotas (Frontend)

Todas as rotas autenticadas usam `NavShellComponent` como wrapper. Features são lazy-loaded:

```typescript
{ path: 'feature', loadComponent: () => import('./features/feature/feature.component').then(m => m.FeatureComponent) }
```

Guards: `authGuard` (redireciona para login) e `publicGuard` (redireciona para dashboard).

---

## Documentação

- Toda documentação técnica fica em `docs/` com subdiretórios temáticos
- Formato: Markdown com template de 8 seções (Executive Summary → Appendix)
- Manter `CLAUDE_CONTEXT.md` atualizado após cada sprint significativa
