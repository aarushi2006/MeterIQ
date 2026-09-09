# Understanding The RUL Model

## 1. Problem Setup

Each engine produces a sequence of sensor readings over many operating cycles.

The goal is to predict:

`RUL = number of cycles remaining before failure`

This is a sequence regression problem because the model must understand how sensor behavior evolves over time.

## 2. Why LSTM?

An LSTM is useful because:

- It reads sequential data in order
- It keeps a memory of past operating behavior
- It can learn gradual degradation patterns
- It handles variable health trajectories better than simple static models

In this project, the LSTM reads a sliding window of recent sensor history and converts it into a compact hidden state.

## 3. Input Representation

For each engine:

- Rows are operating cycles
- Columns are sensor features and operating settings
- We convert the long history into many fixed-length windows

Example window:

```text
time t-29  sensor values...
time t-28  sensor values...
...
time t     sensor values...
```

The target is the RUL at time `t`.

## 4. Degradation Pattern Learning

The model does not explicitly know physics rules.
It learns degradation by seeing many examples where:

- healthy engines have stable signals
- degrading engines show drifting sensor patterns
- late-life engines map to low RUL

The LSTM hidden state becomes a learned summary of health condition.

## 5. Uncertainty Estimation

Point predictions are not enough for safety-critical maintenance.

This project uses Monte Carlo dropout:

- Dropout stays active during inference
- The model predicts several times for the same sequence
- We compute mean and standard deviation across predictions

Interpretation:

- low standard deviation = model is confident
- high standard deviation = model is unsure

This helps planners decide whether to trust the estimate or inspect the engine more carefully.

## 6. Domain Adaptation

Aircraft engines operate under different environments and fleets.
Data distributions can shift because of:

- operating conditions
- environmental stress
- sensor calibration differences
- engine subtype variation

To improve robustness, this project uses a domain classifier with gradient reversal:

- the encoder learns shared features
- the domain head tries to identify source vs target domain
- gradient reversal pushes the encoder to hide domain-specific clues

Result:

The learned representation becomes more transferable across domains.

## 7. Training Loss

The total loss combines:

- RUL regression loss: mean squared error
- Domain adaptation loss: cross-entropy for domain labels

Conceptually:

```text
total_loss = regression_loss + lambda * domain_loss
```

`lambda` controls how strongly we encourage domain invariance.

## 8. Evaluation Metrics

- RMSE: penalizes large RUL mistakes
- MAE: average absolute prediction error
- Coverage: how often true RUL falls inside the uncertainty interval
- Mean uncertainty: average predictive standard deviation

## 9. What To Improve Next

- Try bidirectional LSTM or Transformer encoders
- Add attention over time steps
- Train on FD001 to FD004 separately and jointly
- Use adversarial or contrastive pretraining
- Estimate calibrated uncertainty with deep ensembles
- Add maintenance cost-aware decision thresholds
