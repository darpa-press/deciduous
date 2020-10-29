import React from "react";
import Loadable from "react-loadable";
import Loading from "Components/Loading/Loading";

export default Loadable({
    loader: () => import("./Graph"),
    loading() {
        return <Loading />;
    }
});
