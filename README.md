# SNATCH! MVP

Greybox jogável do loop principal aprovado: `grab -> risk -> cash out -> bust / One More -> replay`.

## Rodar

Não há dependências externas.

```bash
npm test
python3 -m http.server 4173
```

Abra `http://localhost:4173` no navegador.

Também funciona abrindo `index.html` diretamente em navegadores que permitem scripts locais.

## Controles

- Arraste no canvas para trás da garra e solte para lançar.
- Cada acerto coloca valor no BAG e aumenta HEAT/chain.
- Segure CASH OUT por 650 ms para mover BAG para BANKED.
- Se HEAT chegar a 100, o BAG é perdido e o BANKED permanece seguro.
- Ao final de 60 s, se ainda houver BAG, escolha entre salvar ou tentar ONE MORE.

## Modos deste MVP

- Quick Practice na primeira visita.
- Daily Heist determinístico por data, com uma tentativa oficial local por dia.
- Practice Daily após consumir o Daily.
- Free Run procedural.

## Limites intencionais

Este é o Milestone A, focado em game feel. Ainda não há backend, leaderboard global, anti-cheat remoto, contas, coleção/Fuse nem arte final. A tentativa diária é protegida apenas por `localStorage`, suficiente para validar o loop, não para produção competitiva.

## Deploy

O MVP é 100% estático e sem dependências de runtime. No Vercel, basta importar o repositório e manter **Framework Preset: Other**. Não há build command nem output directory obrigatórios.

O arquivo `vercel.json` adiciona clean URLs e headers básicos de segurança.

## Documentação

- Spec aprovada: `docs/superpowers/specs/2026-08-24-snatch-daily-heist-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-08-24-snatch-mvp-implementation-plan.md`
