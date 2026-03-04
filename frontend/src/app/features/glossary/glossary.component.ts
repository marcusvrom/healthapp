import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface GlossaryTerm {
  term: string;
  acronym?: string;
  category: 'metabolismo' | 'nutricao' | 'hormonal' | 'treino' | 'clinico';
  definition: string;
}

const TERMS: GlossaryTerm[] = [
  // ── Metabolismo ──────────────────────────────────────────────────────────────
  {
    term: 'Taxa Metabólica Basal', acronym: 'TMB',
    category: 'metabolismo',
    definition: 'Quantidade mínima de energia (kcal/dia) que o organismo gasta em repouso absoluto para manter funções vitais: respiração, circulação, regulação da temperatura e funcionamento dos órgãos. Calculada pela equação de Mifflin-St Jeor neste aplicativo.',
  },
  {
    term: 'Gasto Energético Total', acronym: 'GET / TDEE',
    category: 'metabolismo',
    definition: 'Energia total gasta por dia, incluindo TMB × fator de atividade física (PAL) + calorias do exercício. É o ponto de referência para definir déficit ou superávit calórico.',
  },
  {
    term: 'Déficit Calórico',
    category: 'metabolismo',
    definition: 'Estado em que a ingestão calórica diária é menor que o GET. Um déficit de ~500 kcal/dia resulta em perda de ~0,5 kg/semana. É a base do emagrecimento saudável.',
  },
  {
    term: 'Superávit Calórico',
    category: 'metabolismo',
    definition: 'Estado em que a ingestão calórica supera o GET. Necessário para ganho de massa muscular (bulk). Um superávit controlado de +200 a +400 kcal minimiza ganho de gordura.',
  },
  {
    term: 'Fator de Atividade Física', acronym: 'PAL',
    category: 'metabolismo',
    definition: 'Multiplicador aplicado à TMB para estimar o GET. Varia de 1,2 (sedentário) a 1,9 (muito ativo). Inclui exercícios formais e atividade cotidiana (NEAT).',
  },
  // ── Nutrição ─────────────────────────────────────────────────────────────────
  {
    term: 'Macronutrientes', acronym: 'Macros',
    category: 'nutricao',
    definition: 'Os três grupos de nutrientes que fornecem energia: Proteínas (4 kcal/g), Carboidratos (4 kcal/g) e Gorduras (9 kcal/g). A distribuição ideal varia conforme a meta (emagrecimento, massa, diabético).',
  },
  {
    term: 'Índice Glicêmico', acronym: 'IG',
    category: 'nutricao',
    definition: 'Escala de 0 a 100 que mede a velocidade com que um alimento eleva a glicose sanguínea. Alimentos de IG baixo (<55): aveia, leguminosas. IG alto (>70): pão branco, arroz branco. Fundamental no controle para diabéticos.',
  },
  {
    term: 'Proteína',
    category: 'nutricao',
    definition: 'Macronutriente essencial para síntese muscular, enzimas, hormônios e imunidade. Recomendação: 1,6 g/kg/dia para hipertrofia; até 2,2 g/kg para atletas; 2,0 g/kg para diabéticos (preservação de massa).',
  },
  {
    term: 'Carga Glicêmica', acronym: 'CG',
    category: 'nutricao',
    definition: 'Métrica mais precisa que o IG: considera a quantidade de carboidratos por porção. CG = (IG × carboidratos por porção) / 100. CG baixa (<10) é preferível para controle glicêmico.',
  },
  {
    term: 'BCAA',
    category: 'nutricao',
    definition: 'Aminoácidos de Cadeia Ramificada: Leucina, Isoleucina e Valina. São essenciais, metabolizados diretamente no músculo e estimulam a síntese proteica (mTOR). Úteis em treinos em jejum.',
  },
  {
    term: 'Whey Protein',
    category: 'nutricao',
    definition: 'Proteína do soro do leite com alta biodisponibilidade e rico perfil de aminoácidos. Concentrado (~80% proteína), Isolado (>90%, menos lactose) e Hidrolisado (pré-digerido, absorção mais rápida).',
  },
  {
    term: 'Creatina',
    category: 'nutricao',
    definition: 'Suplemento mais estudado da ciência esportiva. Aumenta os estoques de fosfocreatina muscular, melhorando desempenho em esforços de alta intensidade e curta duração. Dose eficaz: 3-5 g/dia.',
  },
  // ── Hormonal ─────────────────────────────────────────────────────────────────
  {
    term: 'Terapia de Reposição de Testosterona', acronym: 'TRT',
    category: 'hormonal',
    definition: 'Protocolo médico para reposição de testosterona em casos de hipogonadismo (baixa produção endógena). Administrado via injeção, gel ou adesivo. Requer acompanhamento de hematócrito, PSA e lipídios.',
  },
  {
    term: 'Estradiol',
    category: 'hormonal',
    definition: 'Principal estrógeno feminino; presente em menores concentrações no homem. Em homens em TRT, o excesso pode causar retenção hídrica e ginecomastia. Monitorado junto à testosterona.',
  },
  {
    term: 'TSH', acronym: 'TSH',
    category: 'hormonal',
    definition: 'Hormônio Estimulante da Tireoide. Produzido pela hipófise para regular T3 e T4. TSH elevado → hipotireoidismo; TSH baixo → hipertireoidismo. Impacta diretamente TMB e composição corporal.',
  },
  {
    term: 'Insulina',
    category: 'hormonal',
    definition: 'Hormônio produzido pelo pâncreas que regula a glicose sanguínea. Facilita a captação de glicose pelas células. Resistência à insulina é marcador de pré-diabetes e síndrome metabólica.',
  },
  // ── Treino ────────────────────────────────────────────────────────────────────
  {
    term: 'Hipertrofia',
    category: 'treino',
    definition: 'Aumento do volume das fibras musculares por treinamento de resistência. Requer: estímulo mecânico (carga progressiva), proteína adequada (1,6-2,2 g/kg) e superávit calórico moderado.',
  },
  {
    term: 'Score de Hipertrofia',
    category: 'treino',
    definition: 'Métrica interna (0-10) que estima o potencial anabólico dos exercícios registrados. Score ≥8 ativa o teto de proteína (2,2 g/kg) no cálculo de macros pelo CalculationService.',
  },
  {
    term: 'MET', acronym: 'MET',
    category: 'treino',
    definition: 'Equivalente Metabólico de Tarefa. 1 MET = gasto em repouso (~1 kcal/kg/h). Corrida leve: MET 7. Musculação: MET 5. Ciclismo moderado: MET 8. Usado para calcular kcal do exercício.',
  },
  {
    term: 'NEAT',
    category: 'treino',
    definition: 'Termogênese da Atividade sem Exercício. Calorias gastas em atividades do dia a dia (caminhar, limpar, digitar). Pode variar 300-2000 kcal/dia entre indivíduos e impacta muito o GET.',
  },
  // ── Clínico ───────────────────────────────────────────────────────────────────
  {
    term: 'Hemoglobina Glicada', acronym: 'HbA1c',
    category: 'clinico',
    definition: 'Exame que reflete a média de glicose dos últimos 2-3 meses. <5,7%: normal; 5,7-6,4%: pré-diabetes; ≥6,5%: diabetes. Meta para diabéticos em tratamento: ≤7,0%.',
  },
  {
    term: 'Índice de Massa Corporal', acronym: 'IMC',
    category: 'clinico',
    definition: 'Peso (kg) ÷ Altura² (m). Parâmetro de triagem: <18,5 baixo peso; 18,5-24,9 normal; 25-29,9 sobrepeso; ≥30 obesidade. Não diferencia massa magra de gordura.',
  },
  {
    term: 'Proteína C-Reativa', acronym: 'PCR / CRP',
    category: 'clinico',
    definition: 'Marcador de inflamação sistêmica produzido pelo fígado. PCR <1 mg/L: baixo risco cardiovascular; 1-3 mg/L: intermediário; >3 mg/L: alto risco. Reduzida por exercício e dieta anti-inflamatória.',
  },
  {
    term: 'Vitamina D',
    category: 'clinico',
    definition: 'Pró-hormônio essencial para saúde óssea, imunidade, função muscular e regulação do humor. Síntese via exposição solar. Deficiência (<20 ng/mL) é muito prevalente. Reposição via suplementação oral.',
  },
  {
    term: 'Ferritina',
    category: 'clinico',
    definition: 'Proteína de armazenamento de ferro. Ferritina baixa indica depleção de estoques (mesmo que hemoglobina normal). Sintomas: fadiga, queda de cabelo, dificuldade de concentração.',
  },
];

const CATEGORY_CONFIG = {
  metabolismo: { label: 'Metabolismo',  color: '#10b981', bg: '#d1fae5', icon: '⚡' },
  nutricao:    { label: 'Nutrição',     color: '#f59e0b', bg: '#fef3c7', icon: '🥗' },
  hormonal:    { label: 'Hormonal',     color: '#8b5cf6', bg: '#ede9fe', icon: '💉' },
  treino:      { label: 'Treino',       color: '#6366f1', bg: '#e0e7ff', icon: '💪' },
  clinico:     { label: 'Clínico',      color: '#ef4444', bg: '#fee2e2', icon: '🩺' },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

@Component({
  selector: 'app-glossary',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .page { padding: 1.5rem; max-width: 860px; margin: 0 auto; background: var(--color-bg) !important; }

    .page-header { margin-bottom: 1.5rem;
      h2 { font-size: 1.5rem; margin-bottom: .25rem; }
      p  { color: var(--color-text-muted); font-size: .9rem; }
    }

    .controls {
      display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem;

      .search-wrap {
        flex: 1; min-width: 200px; position: relative;
        .search-icon { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%);
          color: var(--color-text-subtle); pointer-events: none; font-style: normal; }
        input { width: 100%; padding: .625rem .875rem .625rem 2.25rem;
          border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
          font-size: .9rem; background: var(--color-surface); color: var(--color-text);
          outline: none; transition: border-color .15s;
          &:focus { border-color: var(--color-primary); }
          &::placeholder { color: var(--color-text-subtle); }
        }
      }

      .filter-chips { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
      .chip-btn {
        padding: .35rem .875rem; border-radius: 99px; font-size: .78rem; font-weight: 600;
        border: 1.5px solid var(--color-border); background: var(--color-surface);
        color: var(--color-text-muted); cursor: pointer; transition: all .15s;
        &.active { border-color: transparent; color: #fff; }
        &:hover:not(.active) { background: var(--color-surface-2); }
      }
    }

    .count { font-size: .82rem; color: var(--color-text-muted); margin-bottom: 1rem; font-weight: 500; }

    .terms-list { display: flex; flex-direction: column; gap: .875rem; }

    .term-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.125rem 1.25rem;
      transition: box-shadow .15s;
      cursor: default;
      &:hover { box-shadow: var(--shadow-sm); }

      .term-header {
        display: flex; align-items: flex-start; gap: .75rem; margin-bottom: .5rem;
        .cat-badge {
          display: inline-flex; align-items: center; gap: .25rem;
          font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 99px;
          flex-shrink: 0; margin-top: .15rem;
        }
        .title-block {
          flex: 1;
          .term-name { font-size: 1rem; font-weight: 700; color: var(--color-text); line-height: 1.3; }
          .acronym   { font-size: .8rem; font-weight: 600; color: var(--color-text-muted); margin-top: .1rem; }
        }
      }

      .definition { font-size: .875rem; color: var(--color-text-muted); line-height: 1.65; }
    }

    .empty { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; }
      p { font-size: .9rem; }
    }
  `],
  template: `
    <div class="page animate-fade">
      <div class="page-header">
        <h2>❓ Glossário de Saúde</h2>
        <p>Dicionário de termos técnicos utilizados no aplicativo — {{ total }} termos disponíveis.</p>
      </div>

      <div class="controls">
        <div class="search-wrap">
          <i class="search-icon">🔍</i>
          <input type="text" placeholder="Buscar termo..." [(ngModel)]="query" />
        </div>

        <div class="filter-chips">
          <button class="chip-btn" [class.active]="activeCategory() === null"
            style="border-color:var(--color-primary)"
            [style.background]="activeCategory() === null ? 'var(--color-primary)' : ''"
            (click)="setCategory(null)">
            Todos
          </button>
          @for (entry of categoryEntries; track entry.key) {
            <button class="chip-btn" [class.active]="activeCategory() === entry.key"
              [style.background]="activeCategory() === entry.key ? entry.cfg.color : ''"
              [style.border-color]="entry.cfg.color"
              [style.color]="activeCategory() === entry.key ? '#fff' : entry.cfg.color"
              (click)="setCategory(entry.key)">
              {{ entry.cfg.icon }} {{ entry.cfg.label }}
            </button>
          }
        </div>
      </div>

      <div class="count">
        {{ filtered().length }} resultado{{ filtered().length !== 1 ? 's' : '' }}
        @if (query.length > 0) { para "<strong>{{ query }}</strong>" }
      </div>

      @if (filtered().length > 0) {
        <div class="terms-list stagger">
          @for (t of filtered(); track t.term) {
            <div class="term-card animate-fade">
              <div class="term-header">
                <span class="cat-badge"
                  [style.background]="catCfg(t.category).bg"
                  [style.color]="catCfg(t.category).color">
                  {{ catCfg(t.category).icon }} {{ catCfg(t.category).label }}
                </span>
                <div class="title-block">
                  <div class="term-name">{{ t.term }}</div>
                  @if (t.acronym) { <div class="acronym">{{ t.acronym }}</div> }
                </div>
              </div>
              <div class="definition">{{ t.definition }}</div>
            </div>
          }
        </div>
      } @else {
        <div class="empty">
          <span class="emoji">🔎</span>
          <p>Nenhum termo encontrado para "<strong>{{ query }}</strong>".<br>Tente outra busca.</p>
        </div>
      }
    </div>
  `,
})
export class GlossaryComponent {
  readonly total = TERMS.length;

  query          = '';
  activeCategory = signal<Category | null>(null);

  readonly categoryEntries = (Object.keys(CATEGORY_CONFIG) as Category[]).map(k => ({
    key: k,
    cfg: CATEGORY_CONFIG[k],
  }));

  readonly filtered = () => {
    const q   = this.query.toLowerCase().trim();
    const cat = this.activeCategory();

    return TERMS.filter(t => {
      if (cat && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.term.toLowerCase().includes(q) ||
        t.acronym?.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
      );
    });
  };

  setCategory(cat: Category | null): void {
    this.activeCategory.set(cat);
  }

  catCfg(cat: Category) {
    return CATEGORY_CONFIG[cat];
  }
}
