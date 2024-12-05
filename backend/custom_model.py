from transformers import PreTrainedModel, PretrainedConfig
import torch
import torch.nn as nn


# Define the custom configuration class
class TinyTimeMixerConfig(PretrainedConfig):
    model_type = "tinytimemixer"

    def __init__(
        self,
        num_input_channels=1,
        d_model=256,
        num_layers=4,
        self_attn_heads=8,
        dropout=0.1,
        expansion_factor=4,
        norm_eps=1e-5,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.num_input_channels = num_input_channels
        self.d_model = d_model
        self.num_layers = num_layers
        self.self_attn_heads = self_attn_heads
        self.dropout = dropout
        self.expansion_factor = expansion_factor
        self.norm_eps = norm_eps


# Define the custom model class
class TinyTimeMixerForPrediction(PreTrainedModel):
    config_class = TinyTimeMixerConfig  # Link to the custom configuration class

    def __init__(self, config):
        super().__init__(config)

        # Model parameters from config
        self.d_model = config.d_model
        self.num_layers = config.num_layers
        self.dropout_rate = config.dropout
        self.expansion_factor = config.expansion_factor

        # Input projection layer to transform input features to d_model dimensions
        self.input_projection = nn.Linear(config.num_input_channels, self.d_model)

        # Multi-head attention layers
        self.attention_layers = nn.ModuleList([
            nn.MultiheadAttention(embed_dim=self.d_model, num_heads=config.self_attn_heads, dropout=self.dropout_rate)
            for _ in range(self.num_layers)
        ])

        # Feed-forward layers
        self.mlp = nn.Sequential(
            nn.Linear(self.d_model, self.d_model * self.expansion_factor),
            nn.ReLU(),
            nn.Dropout(self.dropout_rate),
            nn.Linear(self.d_model * self.expansion_factor, 1)  # Output single prediction per time step
        )

        # Layer normalization
        self.layer_norm = nn.LayerNorm(self.d_model, eps=config.norm_eps)

    def forward(self, input_ids, attention_mask=None, labels=None):
        # Apply input projection
        x = self.input_projection(input_ids)

        # Pass through each attention layer
        for attn_layer in self.attention_layers:
            x, _ = attn_layer(x, x, x)  # Self-attention

        # Apply layer normalization
        x = self.layer_norm(x)

        # Pass through the MLP for final output
        output = self.mlp(x)

        return output
