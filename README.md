# SNATCH! MVP v0.3 — The Claw Update

Browser-first Daily Heist sobre uma decisão simples: `pegar -> arriscar -> cash out -> ou tentar só mais um`.

A v0.3 combina a identidade visual do SNATCH com uma garra física determinística: ela sai da base, intercepta o loot em movimento, prende o item, volta mais rápido e só então entrega a recompensa ao `BAG`.

## Rodar

Não há dependências de runtime.

```bash
npm test
npm run test:browser
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Controles

- Arraste no canvas para trás da garra e solte para lançar.
- A garra precisa viajar, prender o loot e voltar à base antes de pontuar.
- Cada entrega aumenta `BAG`, `HEAT` e chain.
- Em HEAT alto, `RISK PAYOUT` recompensa a ganância: `+10% HOT`, `+25% CRITICAL`.
- Segure `CASH OUT` por 650 ms para mover `BAG` para `BANKED`.
- Se HEAT chegar a 100, o BAG é perdido e o BANKED continua seguro.
- No fim da run, um BAG pendente libera `ONE MORE`: uma última garra física valendo 2x ou perda total daquele BAG.

## O que entrou na v0.3

- `src/claw.js`: simulação física determinística em passos fixos de 120 Hz lógicos.
- Retração mais rápida que a ida, cabo visível e loot preso à garra.
- Colisão em coordenadas corrigidas para a arena 9:16.
- Loot com identidade visual, raridade, valor e glow.
- Mini-BAG com os últimos itens em risco.
- Heartbeat procedural e vignette por tier de HEAT.
- Hit feedback com partículas, vibração e screen shake respeitando `prefers-reduced-motion`.
- Daily reservado ao iniciar, data da run preservada na virada UTC e BUST tardio capaz de encerrar a rodada normalmente.

## Modos

- Quick Practice na primeira visita.
- Daily Heist determinístico por data, com uma tentativa oficial local por dia.
- Practice Daily após consumir a tentativa oficial.
- Free Run procedural.

## Limites atuais

Este ainda é um MVP local-first. Não há backend, leaderboard global, anti-cheat remoto, contas, coleção/Fuse ou assets finais. `localStorage` protege a tentativa diária apenas o suficiente para validar o produto, não para uma competição pública confiável.

## Arquitetura

- `src/core.js`: score, BAG/BANKED, HEAT, Daily, challenge e regras puras.
- `src/risk.js`: tiers e payout de risco.
- `src/input.js`: normalização do ponteiro e gesto pull-back.
- `src/claw.js`: trajetória, contato, latch, retorno e settling determinísticos.
- `app.js`: orquestração, canvas, áudio, HUD e fluxo de telas.

## Deploy

O projeto é estático. No Vercel use Framework Preset `Other`, sem build command ou output directory obrigatórios.

## Documentação

- Spec de produto: `docs/superpowers/specs/2026-08-24-snatch-daily-heist-design.md`
- Design v0.3: `docs/superpowers/specs/2026-08-25-snatch-v03-claw-update-design.md`
- Plano v0.3: `docs/superpowers/plans/2026-08-25-snatch-v03-claw-update.md`
