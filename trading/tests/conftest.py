import numpy as np
import pandas as pd
import pytest

from spx import config


@pytest.fixture
def cfg():
    return config.laden(umgebung={})


def tageskerzen(n=260, start=100.0, trend=0.3, seed=1, ende="2026-10-22"):
    """Synthetische Tageskerzen (Index: Handelsdaten als datetime.date)."""
    rng = np.random.default_rng(seed)
    tage = pd.bdate_range(end=ende, periods=n)
    close = start + np.cumsum(trend + rng.normal(0, 1, n))
    open_ = close - rng.normal(0, 0.5, n)
    high = np.maximum(open_, close) + rng.uniform(0.2, 1.5, n)
    low = np.minimum(open_, close) - rng.uniform(0.2, 1.5, n)
    vol = rng.uniform(4e6, 6e6, n)
    df = pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": vol}, index=tage.date)
    return df


@pytest.fixture
def kerzen():
    return tageskerzen
