# CLAUDE.md - Convenções do Projeto AiraFit

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

## Convenções Gerais

- Linguagem da interface: Português (pt-BR)
- Framework: Angular 17+ com standalone components e novo control flow (@if, @for, @switch)
- Estado local: Angular Signals (signal, computed, effect)
- Estilização: SCSS com variáveis CSS custom properties (--color-primary, --radius-md, etc.)
