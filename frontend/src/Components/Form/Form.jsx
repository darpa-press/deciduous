import styled from "styled-components";
import { PageInside } from "Components/Page/Page";

export const FormPage = styled(PageInside)`
    font-family: "FigginsItalic", -apple-system, BlinkMacSystemFont, sans-serif;

    label {
        display: block;
        opacity: 0.4;
        margin-bottom: 0.1rem;
    }

    input[type="checkbox"] {
        margin-right: 0.4rem;
    }

    input[type="text"],
    .Select,
    button {
        margin-bottom: 1rem;
    }

    input[type="text"] {
        width: 100%;
        padding: 0.25rem;
    }

    input[type="color"] {
        position: relative;
        top: 1px;
        height: 1.86rem;
        width: 1.86rem;
        margin-right: 0.25rem;
    }

    input::placeholder {
        color: rgba(0, 0, 0, 0.4);
    }

    textarea {
        border: 1px solid #e8e8e8;
        padding: 0.5rem;
        font-size: 1rem;
        margin-bottom: 1rem;
    }

    .ace_editor {
        width: 100% !important;
        font-family: "Operator Mono", "Source Code Pro", monospace;
        /* font-size:15px; */
        font-weight: 500;
        margin-bottom: 2rem;
    }
`;
export const EditTitle = styled.input``;

export const FormFlex = styled.div`
    display: flex;

    label {
        flex: 0 0 6rem;
    }
    .Select {
        flex: 1 1 100%;
    }
    textarea {
        flex: 1 1 100%;
    }
`;

export const FormButtons = styled.div`
    margin-top: 3rem;
`;

export const CombinedInput = styled.div`
    display: flex;
    width: 100%;
`;

export const CheckboxLabel = styled.label`
    opacity: 1;
    -moz-user-select: none;
    -khtml-user-select: none;
    -webkit-user-select: none;
    margin-bottom: 0.25rem;
    &:last-of-type {
        margin-bottom: 1rem;
    }
`;

export const FileUploadContainer = styled(FormFlex)`
    margin-bottom: 1rem;
`;

export const ProgressBar = styled.div`
    position: relative;
    width: 100%;
    height: 1rem;
    background: #eee;
    margin-bottom: 1rem;
`;
export const ProgressBarBar = styled.div`
    background: #555;
    position: absolute;
    top: 0;
    left: 0;
    height: 1rem;
`;

export const FileUploadFiles = styled.ul`
    padding: 0;
    margin: 1rem 0;
    display: flex;
    flex-wrap: wrap;
`;

export const FileUploadFile = styled.li`
    border: 1px solid #eee;
    list-style-type: none;
    margin: 0;
    margin-right: 2%;
    margin-bottom: 0.5rem;
    padding: 0;
    width: 23.5%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.3rem;

    a {
        font-size: 0.75rem;
        font-weight: 600;
    }
    a:hover {
        background: none;
    }
    &:nth-child(4n) {
        margin-right: 0;
    }
`;

export const FileUploadImage = styled.img`
    width: 100%;
    height: auto;
    margin: 0;
`;
