import React from "react";
import api from "common/api";

import {
    FileUploadContainer,
    FileUploadFiles,
    FileUploadFile,
    FileUploadImage,
    ProgressBar,
    ProgressBarBar
} from "Components/Form/Form";

export default class FileUpload extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            uploading: false,
            percentCompleted: 0,
            files: []
        };
    }

    async handleChange(e) {
        this.setState({ fileValue: e.target });
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file, file.name);
        await this.upload(formData);
    }

    async upload(formData) {
        this.setState({
            uploading: true
        });

        const config = {
            onUploadProgress: progressEvent => {
                this.setState({
                    percentCompleted: Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    )
                });
            }
        };

        const uploadedFile = await api.uploadFile(formData, config);
        // stuff on completion here

        this.setState({
            uploading: false,
            files: [...this.state.files, uploadedFile]
        });
    }

    render() {
        return (
            <FileUploadContainer>
                <label>Upload files</label>
                <div>
                    <input
                        name="file"
                        onChange={this.handleChange.bind(this)}
                        type="file"
                    />
                    {this.state.uploading && (
                        <ProgressBar>
                            <ProgressBarBar
                                style={{
                                    width: `${this.state.percentCompleted}%`
                                }}
                            />
                        </ProgressBar>
                    )}
                    {this.state.files.length > 0 && (
                        <FileUploadFiles>
                            {this.state.files.map(file => (
                                <FileUploadFile>
                                    <a
                                        href={file.location}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <FileUploadImage
                                            alt="Preview"
                                            src={file.location}
                                        />
                                    </a>
                                </FileUploadFile>
                            ))}
                        </FileUploadFiles>
                    )}
                </div>
            </FileUploadContainer>
        );
    }
}
