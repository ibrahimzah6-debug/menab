# ModelPicker

Lets the user switch the model for a generation, with a sample and the price on each option.

Each option shows a sample clip or image (`mn-model__thumb`), the model name and one meta line: what it is good at and its cost. The default is marked "Default". The selected option gets a 2px `ink` outline. Behaves as a radio group. The consumer provides the models, their samples and live prices from the model routing settings; never hard-code prices.
