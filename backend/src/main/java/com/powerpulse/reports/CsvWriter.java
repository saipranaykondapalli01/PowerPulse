package com.powerpulse.reports;

import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.util.List;

/**
 * Minimal RFC 4180 CSV writer: CRLF line endings, fields containing a comma, quote, CR or LF are quoted and
 * embedded quotes doubled. Text cells starting with {@code = + - @} (or a tab / carriage return) are prefixed with
 * a single quote so spreadsheet applications do not evaluate them as formulas (CSV injection). Numbers are written
 * as-is, so negative values stay numeric.
 */
public final class CsvWriter {

    private final Writer out;

    public CsvWriter(Writer out) {
        this.out = out;
    }

    public void row(List<?> cells) throws IOException {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                line.append(',');
            }
            line.append(cell(cells.get(i)));
        }
        line.append("\r\n");
        out.write(line.toString());
    }

    public void flush() throws IOException {
        out.flush();
    }

    /** Formats a single cell value (escaped and injection-guarded). */
    public static String cell(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Double d) {
            return d.isNaN() || d.isInfinite() ? "" : BigDecimal.valueOf(d).stripTrailingZeros().toPlainString();
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        return escape(guard(value.toString()));
    }

    static String guard(String text) {
        if (!text.isEmpty()) {
            char c = text.charAt(0);
            if (c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r') {
                return "'" + text;
            }
        }
        return text;
    }

    static String escape(String text) {
        boolean needsQuotes = text.indexOf(',') >= 0 || text.indexOf('"') >= 0
                || text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0;
        if (!needsQuotes) {
            return text;
        }
        return '"' + text.replace("\"", "\"\"") + '"';
    }
}
