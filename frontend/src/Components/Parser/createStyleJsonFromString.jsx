import camelize from "camelize";

export default styleString => {
    styleString = styleString || "";
    var styles = styleString.split(/;(?!base64)/);
    var singleStyle,
        key,
        value,
        jsonStyles = {};
    for (var i = 0; i < styles.length; ++i) {
        singleStyle = styles[i].split(":");
        if (singleStyle.length > 2) {
            singleStyle[1] = singleStyle.slice(1).join(":");
        }

        key = singleStyle[0];
        value = singleStyle[1];
        if (typeof value === "string") {
            value = value.trim();
        }

        if (
            key != null &&
            value != null &&
            key.length > 0 &&
            value.length > 0
        ) {
            jsonStyles[camelize(key)] = value;
        }
    }
    return jsonStyles;
};
