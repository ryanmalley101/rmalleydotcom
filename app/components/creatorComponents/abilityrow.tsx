// @ts-nocheck
import React, {useEffect, useState} from "react";
import styles from "@/styles/CreateMonsterStatblock.module.css";
import IconButton from "@mui/material/IconButton";
import { BsFillTrashFill } from "react-icons/bs";
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField} from "@mui/material";
import { BsCaretUp } from "react-icons/bs";
import { BsCaretDown } from "react-icons/bs";

const AbilityRow = ({ability, index, handleAbilityUpdate, handleAbilityRemove, moveCreatureItemUp, moveCreatureItemDown}) => {
    const [open, setOpen] = useState(false);
    const handleOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <div className={styles.actionRow}>
            <div style={{display: "flex", width: "90%"}}>
                <div style={{display: "block", width: "40px"}}>
                    <div style={{float:"left"}}>
                        <IconButton type={"button"} onClick={moveCreatureItemUp}>
                            <BsCaretUp/>
                        </IconButton>
                    </div>
                    <div style={{float:"left"}}>
                        <IconButton type={"button"} onClick={moveCreatureItemDown}>
                            <BsCaretDown/>
                        </IconButton>
                    </div>
                </div>
                <div style={{alignContent:"center"}}>
                        <button type={"button"} onClick={() => setOpen(true)} style={{display: "inline-flex", width: "90%"}}>
                            <p><strong>{ability.name}&nbsp;</strong></p>
                            <p>{ability.desc}</p>
                        </button>
                        <IconButton type={"button"} onClick={(index) => handleAbilityRemove(index)}>
                            <BsFillTrashFill/>
                        </IconButton>
                    </div>
            </div>
            <AbilityDialog open={open} ability={ability} index={index} onClose={handleClose}
                           handleAbilityUpdate={handleAbilityUpdate}/>
        </div>
    )
}

const AbilityDialog = ({open, ability, index, onClose, handleAbilityUpdate}) => {

    const [abilityName, setAbilityName] = useState('')
    const [abilityDesc, setAbilityDesc] = useState('')

    useEffect(() => {
        if (ability) {
            setAbilityName(ability.name)
            setAbilityDesc(ability.desc)
        }
    }, [ability]);

    const confirm = () => {
        handleAbilityUpdate({name: abilityName, desc: abilityDesc}, index)
        onClose()
    }

    return <>
        {/* Dialog for entering map size and name */}
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Ability</DialogTitle>
            <DialogContent>
                <TextField
                    label="Name"
                    variant="outlined"
                    fullWidth
                    value={abilityName}
                    onChange={(e) => setAbilityName(e.target.value)}
                    type="text"
                />
                <TextField
                    label="Description"
                    variant="outlined"
                    multiline
                    minRows={4}
                    maxRows={6}
                    fullWidth
                    value={abilityDesc}
                    onChange={(e) => setAbilityDesc(e.target.value)}
                    type="text"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={() => confirm()} color="primary">
                    Update
                </Button>
            </DialogActions>
        </Dialog>
    </>;
}

export default AbilityRow