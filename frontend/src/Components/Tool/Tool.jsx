import React from "react";
import Tooltip from "rc-tooltip";

import "./Tool.css";

export default ({ label, children }) => {
    return (
        <Tooltip
            mouseEnterDelay={0.3}
            mouseLeaveDelay={0.1}
            overlay={<div>{label}</div>}
            placement={"top"}
        >
            {children}
        </Tooltip>
    );
};
