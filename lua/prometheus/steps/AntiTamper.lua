local Step = require("prometheus.step")
local RandomStrings = require("prometheus.randomStrings")
local Parser = require("prometheus.parser")
local Enums = require("prometheus.enums")

local AntiTamper = Step:extend()
AntiTamper.Description = "Prevents modification of the script."
AntiTamper.Name = "Anti Tamper"

function AntiTamper:apply(ast, pipeline)
    if pipeline.PrettyPrint then return ast end

    local originalChecksum = "1234567890" -- Chèn checksum thật khi build
    local randomString = RandomStrings.randomString()

    local code = [[
        local function hash(str)
            local h = 0
            for i = 1, #str do
                h = (h * 31 + str:byte(i)) % 2^32
            end
            return tostring(h)
        end

        local scriptSource = [[ ]] .. randomString .. [[ ]]
        if hash(scriptSource) ~= "]] .. originalChecksum .. [[" then
            error("Tamper Detected!")
        end

        -- Anti Inject: Kiểm tra môi trường runtime
        local env = getfenv()
        for k, v in pairs(env) do
            if type(v) == "function" and not k:find("_G") then
                error("Injection Detected!")
            end
        end
    ]]

    local parsed = Parser:new({LuaVersion = Enums.LuaVersion.Lua51}):parse(code)
    table.insert(ast.body.statements, 1, parsed.body.statements[1])

    return ast
end

return AntiTamper
