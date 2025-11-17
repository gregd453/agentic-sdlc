# Developer Quick Start

## Start Working

```bash
./dev start
```

## Daily Commands

```bash
./dev status       # What's running?
./dev health       # Is everything healthy?
./dev logs         # See what happened
./dev restart      # Fix something by restarting
./dev test         # Run tests
./dev stop         # Done for the day
```

## That's it

Everything else is in the `agentic-sdlc` CLI if you need it, but you probably won't.

## If Something Breaks

```bash
./dev stop
./dev start
./dev test
```

If test passes, you're good.
