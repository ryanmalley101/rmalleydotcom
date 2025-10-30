// @ts-nocheck
import React, {useEffect, useState} from "react";
import styles from "@/styles/CreateMonsterStatblock.module.css";
import IconButton from "@mui/material/IconButton";
import {BsFillTrashFill} from "react-icons/bs";
import { BsCaretUp } from "react-icons/bs";
import { BsCaretDown } from "react-icons/bs";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Select,
    TextField,
    Typography
} from "@mui/material";
import { descAttack } from "./monsterSheet";

const ActionRow = ({
                       action,
                       index,
                       monsterData,
                       handleActionUpdate,
                       handleActionRemove,
                       moveCreatureItemUp,
                       moveCreatureItemDown,
                   }) => {
    const [open, setOpen] = useState(false);

    if (action.type === "Ability") {
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
                            <p><strong>{action.name}&nbsp;</strong></p>
                            <p>{action.desc}</p>
                        </button>
                        <IconButton type={"button"} onClick={(index) => handleActionRemove(index)}>
                            <BsFillTrashFill/>
                        </IconButton>
                    </div>
                </div>
                <ActionDialog open={open} action={action} index={index} onClose={() => setOpen(false)}
                              handleActionUpdate={handleActionUpdate}/>
            </div>
        )
    }
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
                    <button type={"button"} onClick={() => setOpen(true)} style={{display: "inline-flex", fontSize: 16, width: "90%"}}>
                        {descAttack(monsterData, action)}
                    </button>
                    <IconButton type={"button"} onClick={(index) => handleActionRemove(index)}>
                        <BsFillTrashFill/>
                    </IconButton>
                </div>
            </div>
            <ActionDialog open={open} action={action} index={index} onClose={() => setOpen(false)}
                          handleActionUpdate={handleActionUpdate}/>
        </div>


    )
}

const ActionDialog = ({open, action, index, onClose, handleActionUpdate}) => {

    const [name, setName] = useState('Attack Name')
    const [toHit, setToHit] = useState('[STR ATK]')
    const [type, setType] = useState('Melee Weapon Attack')
    const [reach, setReach] = useState(0)
    const [shortRange, setShortRange] = useState(0)
    const [longRange, setLongRange] = useState(0)
    const [targets, setTargets] = useState("One Target.")
    const [effect, setEffect] = useState("")
    const [damage, setDamage] = useState([])

    const addDamage = () => {
        console.log("Adding damage")
        setDamage([...damage, {damage_dice: "", damage_type: ""}])
    }

    const removeDamage = (index) => {
        setDamage(damage.filter((d, dIndex) => index === dIndex ? null : d))
    }

    const handleDamageChange = (newDamage, newIndex) => {
        setDamage(damage.map((oldDamage, oldIndex) => {
            return newIndex === oldIndex ? newDamage : oldDamage
        }))
    }


    useEffect(() => {
        if (action) {
            setName(action.name)
            setEffect(action.desc)
            setToHit(action.attack_bonus)
            setType(action.type)
            setReach(action.reach)
            setShortRange(action.short_range)
            setLongRange(action.long_range)
            setTargets(action.targets)
            setEffect(action.effect)
            setDamage(action.damage)
        }
    }, [action]);

    const confirm = () => {
        handleActionUpdate({
            name: name,
            desc: effect,
            attack_bonus: toHit,
            damage: damage,
            type: type,
            reach: reach,
            short_range: shortRange,
            long_range: longRange,
            targets: targets,
            effect: effect
        }, index)
        onClose()
    }

    const rangeEntry = () => {
        console.log(type)
        switch (type) {
            case "Melee Weapon Attack":
                return <>
                    <TextField
                        label="Reach"
                        variant="outlined"
                        fullWidth
                        value={reach}
                        onChange={(e) => setReach(e.target.value)}
                        type="text"
                    />
                </>
            case "Melee Spell Attack":
                return <>
                    <TextField
                        label="Reach"
                        variant="outlined"
                        fullWidth
                        value={reach}
                        onChange={(e) => setReach(e.target.value)}
                        type="text"
                    />
                </>
            case "Ranged Weapon Attack":
                return <>
                    <TextField
                        label="Short Range"
                        variant="outlined"
                        fullWidth
                        value={shortRange}
                        onChange={(e) => setShortRange(e.target.value)}
                        type="text"
                    />
                    <TextField
                        label="Long Range"
                        variant="outlined"
                        fullWidth
                        value={longRange}
                        onChange={(e) => setLongRange(e.target.value)}
                        type="text"
                    />
                </>
            case "Ranged Spell Attack":
                return <>
                    <TextField
                        label="Short Range"
                        variant="outlined"
                        fullWidth
                        value={shortRange}
                        onChange={(e) => setShortRange(e.target.value)}
                        type="text"
                    />
                </>
            default:
                console.error(`Invalid attack type selected for attack`)
                console.error(action, type)
        }
    }

    if (!action) {
        return null
    }

    if (type === "Ability") {
        return <Dialog open={open} onClose={onClose}>
            <DialogTitle>Action</DialogTitle>
            <DialogContent>
                <Select
                    id="attack_type_select"
                    value={type}
                    label="Attack Type"
                    onChange={(e) => setType(e.target.value)}
                >
                    <MenuItem value={"Melee Weapon Attack"}>Melee Weapon Attack</MenuItem>
                    <MenuItem value={"Melee Spell Attack"}>Melee Spell Attacky</MenuItem>
                    <MenuItem value={"Ranged Weapon Attack"}>Ranged Weapon Attack</MenuItem>
                    <MenuItem value={"Ranged Spell Attack"}>Ranged Spell Attack</MenuItem>
                    <MenuItem value={"Ability"}>Ability</MenuItem>
                </Select>
                <TextField
                    label="Name"
                    variant="outlined"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                />
                <TextField
                    label="Description"
                    variant="outlined"
                    multiline
                    minRows={4}
                    maxRows={6}
                    fullWidth
                    value={effect}
                    onChange={(e) => setEffect(e.target.value)}
                    type="text"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={confirm} color="primary">
                    Update
                </Button>
            </DialogActions>
        </Dialog>
    }
    return <>
        {/* Dialog for entering map size and name */}
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Action</DialogTitle>
            <DialogContent>
                <Select
                    id="attack_type_select"
                    value={type}
                    label="Attack Type"
                    onChange={(e) => setType(e.target.value)}
                >
                    <MenuItem value={"Melee Weapon Attack"}>Melee Weapon Attack</MenuItem>
                    <MenuItem value={"Melee Spell Attack"}>Melee Spell Attacky</MenuItem>
                    <MenuItem value={"Ranged Weapon Attack"}>Ranged Weapon Attack</MenuItem>
                    <MenuItem value={"Ranged Spell Attack"}>Ranged Spell Attack</MenuItem>
                    <MenuItem value={"Ability"}>Ability</MenuItem>
                </Select>
                <TextField
                    label="Name"
                    variant="outlined"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                />
                <TextField
                    label="Effect"
                    variant="outlined"
                    multiline
                    minRows={4}
                    maxRows={6}
                    fullWidth
                    value={effect}
                    onChange={(e) => setEffect(e.target.value)}
                    type="text"
                />
                <TextField
                    label="To Hit"
                    variant="outlined"
                    fullWidth
                    value={toHit}
                    onChange={(e) => setToHit(e.target.value)}
                    type="text"
                />
                <TextField
                    label="Targets"
                    variant="outlined"
                    fullWidth
                    value={targets}
                    onChange={(e) => setTargets(e.target.value)}
                    type="text"
                />
                {rangeEntry()}
                <Typography component="div">
                    Damage:
                    <div>
                        {damage.map((d, dIndex) => {
                            return <div key={dIndex} style={{display: "inline-flex"}}>
                                <TextField
                                    label="Damage String"
                                    variant="outlined"
                                    fullWidth
                                    value={d.damage_dice}
                                    onChange={(e) => handleDamageChange({
                                        damage_dice: e.target.value,
                                        damage_type: d.damage_type
                                    }, dIndex)}
                                    type="text"
                                />
                                <TextField
                                    label="Damage Type"
                                    variant="outlined"
                                    fullWidth
                                    value={d.damage_type}
                                    onChange={(e) => handleDamageChange({
                                        damage_dice: d.damage_dice,
                                        damage_type: e.target.value
                                    }, dIndex)} type="text"
                                />
                                <Button onClick={() => removeDamage(dIndex)}><BsFillTrashFill/></Button>
                            </div>
                        })}
                    </div>
                    <Button onClick={addDamage}>Add Damage</Button>
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={confirm} color="primary">
                    Update
                </Button>
            </DialogActions>
        </Dialog>
    </>;
}

export default ActionRow