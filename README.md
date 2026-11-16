# Ember Warden

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/yansen3w/ember-warden/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/yansen3w/ember-warden/reward.svg)](https://make.fun/bounty/best-game-01)

Ember Warden is a 2D arcade game built for the [best-game-01 bounty](https://make.fun/bounty/best-game-01) on make.fun.

You are a warden with a lantern on a night ridge, firing ember bolts upward against five waves of gloom-moths: drifting moths, darters that dive at you, weavers with 2 HP, and the wave-5 boss, the Gloom Queen (40 HP, dark orbs, spawns moths). Clear all five waves to win. Score with a combo multiplier, 3 lives, a heal after each cleared wave, and blessings that drop mid-fight (Triple Embers, Swift Hand, Ward Shield).

## Play

- Move: Arrow keys or mouse
- Shoot: Space or click
- Pause: P
- Restart: Space or click on the end screen

No image, font, or audio files: everything is drawn with canvas primitives and the sound is synthesized with WebAudio. The game runs fully offline in a desktop browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## Entry

`main.ts` (Node 22, standard library only) hands the game in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library (`vendor/makefun-game.ts`).

## License

MIT — see [LICENSE](LICENSE).
