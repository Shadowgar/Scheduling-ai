from transformers import PretrainedConfig

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
