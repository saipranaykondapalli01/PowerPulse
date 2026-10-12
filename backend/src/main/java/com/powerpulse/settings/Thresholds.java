package com.powerpulse.settings;


public class Thresholds {

    private static ThresholdBand band(double good, double warn, double critical) {
        ThresholdBand b = new ThresholdBand();
        b.setGood(good);
        b.setWarn(warn);
        b.setCritical(critical);
        return b;
    }

    private ThresholdBand temperatureC = band(65, 85, 105);
    private ThresholdBand oilLevelPct = band(80, 60, 40);
    private ThresholdBand loadPct = band(70, 90, 110);
    private ThresholdBand voltageDeviationPct = band(2, 5, 10);
    private ThresholdBand currentPctOfRated = band(75, 95, 115);

    public ThresholdBand getTemperatureC() {
        return temperatureC;
    }

    public void setTemperatureC(ThresholdBand temperatureC) {
        this.temperatureC = temperatureC;
    }

    public ThresholdBand getOilLevelPct() {
        return oilLevelPct;
    }

    public void setOilLevelPct(ThresholdBand oilLevelPct) {
        this.oilLevelPct = oilLevelPct;
    }

    public ThresholdBand getLoadPct() {
        return loadPct;
    }

    public void setLoadPct(ThresholdBand loadPct) {
        this.loadPct = loadPct;
    }

    public ThresholdBand getVoltageDeviationPct() {
        return voltageDeviationPct;
    }

    public void setVoltageDeviationPct(ThresholdBand voltageDeviationPct) {
        this.voltageDeviationPct = voltageDeviationPct;
    }

    public ThresholdBand getCurrentPctOfRated() {
        return currentPctOfRated;
    }

    public void setCurrentPctOfRated(ThresholdBand currentPctOfRated) {
        this.currentPctOfRated = currentPctOfRated;
    }
}
