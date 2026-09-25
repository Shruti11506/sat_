"""Concrete ModelService implementations.

`remote.RemoteModelService` is how the backend reaches the real models: each
model runs as its own inference server (sat_ml/serving/), in its own Python
environment and ideally on the GPU machine. The backend never imports torch.
"""
