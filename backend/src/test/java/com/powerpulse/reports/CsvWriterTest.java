package com.powerpulse.reports;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.StringWriter;
import java.time.Instant;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class CsvWriterTest {

    @Test
    void escapesPerRfc4180() {
        assertThat(CsvWriter.cell("plain")).isEqualTo("plain");
        assertThat(CsvWriter.cell("a,b")).isEqualTo("\"a,b\"");
        assertThat(CsvWriter.cell("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(CsvWriter.cell("line1\nline2")).isEqualTo("\"line1\nline2\"");
        assertThat(CsvWriter.cell("cr\rhere")).isEqualTo("\"cr\rhere\"");
        assertThat(CsvWriter.cell(null)).isEmpty();
        assertThat(CsvWriter.cell("")).isEmpty();
    }

    @Test
    void guardsAgainstFormulaInjection() {
        assertThat(CsvWriter.cell("=1+2")).isEqualTo("'=1+2");
        assertThat(CsvWriter.cell("+1")).isEqualTo("'+1");
        assertThat(CsvWriter.cell("-1")).isEqualTo("'-1");
        assertThat(CsvWriter.cell("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(CsvWriter.cell("\tcmd")).isEqualTo("'\tcmd");
        assertThat(CsvWriter.cell("=HYPERLINK(\"x\",\"y\")")).isEqualTo("\"'=HYPERLINK(\"\"x\"\",\"\"y\"\")\"");
        assertThat(CsvWriter.cell("a=b")).isEqualTo("a=b");
    }

    @Test
    void numbersBooleansAndInstantsAreWrittenPlainly() {
        assertThat(CsvWriter.cell(-5.5)).isEqualTo("-5.5");
        assertThat(CsvWriter.cell(400.0)).isEqualTo("400");
        assertThat(CsvWriter.cell(1.0E7)).isEqualTo("10000000");
        assertThat(CsvWriter.cell(Double.NaN)).isEmpty();
        assertThat(CsvWriter.cell(-3L)).isEqualTo("-3");
        assertThat(CsvWriter.cell(true)).isEqualTo("true");
        assertThat(CsvWriter.cell(Instant.parse("2026-01-02T03:04:05Z"))).isEqualTo("2026-01-02T03:04:05Z");
    }

    @Test
    void rowsUseCrlf() throws Exception {
        StringWriter out = new StringWriter();
        CsvWriter csv = new CsvWriter(out);
        csv.row(Arrays.asList("a", null, 1));
        csv.row(Arrays.asList("b,c", "=x", 2.5));
        csv.flush();
        assertThat(out.toString()).isEqualTo("a,,1\r\n\"b,c\",'=x,2.5\r\n");
    }
}
