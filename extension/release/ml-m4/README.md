# M4 ML artifact staging

This directory contains the two files authorized for M4 release-process staging:

- `b2-limited-logistic-training-state-v1.training-state.json`
- `b2-limited-evaluation-v1.evaluation.json`

They are not bundled into the extension runtime or activated. The training-state schema is
not yet the runtime classifier-artifact schema; compatibility conversion and final release
packaging require a separately verified implementation step.
